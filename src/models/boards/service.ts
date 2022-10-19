import { ValidationError } from "#constants/ValidationError"
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, Like, Repository } from "typeorm"

import { BoardSubjectsService } from "#models/board-subjects/service"
import { UserEntity } from "#models/users/entities/user.entity"
import { UsersService } from "#models/users/service"

import { AddMemberInput } from "./dto/add-member.input"
import { CreateBoardInput } from "./dto/create-board.input"
import { RemoveMemberInput } from "./dto/remove-member.input"
import { SearchBoardsArgs } from "./dto/search-boards.args"
import { UpdateBoardInput } from "./dto/update-board.input"
import { BoardEntity } from "./entities/board.entity"

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(BoardEntity)
    private boardsRepository: Repository<BoardEntity>,
    private boardSubjectsService: BoardSubjectsService,
    private usersService: UsersService
  ) {}

  async search({
    authorizedUser,
    args,
  }: {
    authorizedUser: UserEntity
    args: SearchBoardsArgs
  }): Promise<BoardEntity[]> {
    let boardIdsToSearchBy = (await this.boardsRepository.find()).map((board) => board.id)
    const authorizedUserAdministratedBoardsIds = authorizedUser.administratedBoards.map((board) => board.id)
    if (args.iAmAdminOf === true) {
      boardIdsToSearchBy = boardIdsToSearchBy.filter((boardId) => {
        return authorizedUserAdministratedBoardsIds.includes(boardId)
      })
    }
    if (args.iAmAdminOf === false) {
      boardIdsToSearchBy = boardIdsToSearchBy.filter((boardId) => {
        return !authorizedUserAdministratedBoardsIds.includes(boardId)
      })
    }
    const authorizedUserParticipatedBoardsIds = authorizedUser.boards.map((board) => board.id)
    if (args.iAmMemberOf === true) {
      boardIdsToSearchBy = boardIdsToSearchBy.filter((boardId) => {
        return authorizedUserParticipatedBoardsIds.includes(boardId)
      })
    }
    if (args.iAmMemberOf === false) {
      boardIdsToSearchBy = boardIdsToSearchBy.filter((boardId) => {
        return !authorizedUserParticipatedBoardsIds.includes(boardId)
      })
    }
    if (args.ids !== undefined) {
      const queryIds = args.ids
      boardIdsToSearchBy = boardIdsToSearchBy.filter((boardId) => queryIds.includes(boardId))
    }

    return this.boardsRepository.find({
      order: {
        id: "ASC",
        members: { id: "ASC" },
      },
      relations: { admins: true, members: true, subject: true },
      where: {
        id: In(boardIdsToSearchBy),
        ...(args.subjectsIds !== undefined && { subject: In(args.subjectsIds) }),
        ...(args.name !== undefined && { name: Like(`%${args.name}%`) }),
      },
    })
  }

  async find({ boardId }: { boardId: BoardEntity["id"] }): Promise<BoardEntity> {
    const board = await this.boardsRepository.findOne({
      order: {
        admins: { id: "ASC" },
        members: { id: "ASC" },
      },
      relations: { admins: true, members: true, subject: true },
      where: { id: boardId },
    })
    if (board === null) throw new NotFoundException({ message: "Not found." })
    return board
  }

  async create({
    authorizedUser,
    input,
  }: {
    authorizedUser: UserEntity
    input: CreateBoardInput
  }): Promise<BoardEntity> {
    const subject = await this.boardSubjectsService.find({ subjectId: input.subjectId }).catch(() => {
      throw new BadRequestException({ fields: { subjectId: "Invalid subject." } })
    })
    const similarExistingBoard = await this.boardsRepository.findOne({
      relations: { subject: true },
      where: { name: input.name, subject },
    })
    if (similarExistingBoard !== null) {
      throw new BadRequestException({
        fields: {
          name: `"${similarExistingBoard.name}" ${similarExistingBoard.subject.name} board already exists.`,
          subjectId: `"${similarExistingBoard.name}" ${similarExistingBoard.subject.name} board already exists.`,
        },
      })
    }
    const board = this.boardsRepository.create({
      admins: [authorizedUser],
      members: [authorizedUser],
      name: input.name,
      subject,
    })
    const newlyCreatedBoard = await this.boardsRepository.save(board)
    return await this.find({ boardId: newlyCreatedBoard.id })
  }

  async update({
    authorizedUser,
    input,
  }: {
    authorizedUser: UserEntity
    input: UpdateBoardInput
  }): Promise<BoardEntity> {
    const board = await this.find({ boardId: input.id })
    if (board.admins.every((admin) => admin.id !== authorizedUser.id)) {
      throw new ForbiddenException({ message: "Access denied." })
    }
    if (input.name === undefined && input.subjectId === undefined) return board
    if (input.name !== undefined) {
      if (input.name === "") {
        throw new BadRequestException({ fields: { name: ValidationError.REQUIRED } })
      }
      board.name = input.name
    }
    if (input.subjectId !== undefined) {
      board.subject = await this.boardSubjectsService.find({ subjectId: input.subjectId }).catch(() => {
        throw new BadRequestException({ fields: { subjectId: "Invalid board subject." } })
      })
    }
    const similarExistingBoard = await this.boardsRepository.findOne({
      relations: { subject: true },
      where: { name: board.name, subject: board.subject },
    })
    if (similarExistingBoard !== null) {
      throw new BadRequestException({
        fields: {
          name: `"${similarExistingBoard.name}" ${similarExistingBoard.subject.name} board already exists.`,
          subjectId: `"${similarExistingBoard.name}" ${similarExistingBoard.subject.name} board already exists.`,
        },
      })
    }
    return this.boardsRepository.save(board)
  }

  async delete({
    authorizedUser,
    boardId,
  }: {
    authorizedUser: UserEntity
    boardId: BoardEntity["id"]
  }): Promise<BoardEntity> {
    const board = await this.find({ boardId })
    if (board.admins.every((admin) => admin.id !== authorizedUser.id)) {
      throw new ForbiddenException({ message: "Access denied." })
    }
    await this.boardsRepository.delete(boardId)
    return board
  }

  async addMember({
    authorizedUser,
    input,
  }: {
    authorizedUser: UserEntity
    input: AddMemberInput
  }): Promise<BoardEntity> {
    if (authorizedUser.administratedBoards.every((board) => board.id !== input.boardId)) {
      throw new ForbiddenException({ message: "Access denied." })
    }
    const candidateToMembers = await this.usersService.find({
      userId: input.userId,
      relations: { boards: true },
    })
    if (candidateToMembers.boards.some((board) => board.id === input.boardId)) {
      throw new BadRequestException({ message: "The user is already a member of the board." })
    }
    const board = await this.find({ boardId: input.boardId })
    board.members = [...board.members, candidateToMembers]
    await this.boardsRepository.save(board)
    return await this.find({ boardId: input.boardId })
  }

  async removeMember({
    authorizedUser,
    input,
  }: {
    authorizedUser: UserEntity
    input: RemoveMemberInput
  }): Promise<BoardEntity> {
    if (authorizedUser.administratedBoards.every((board) => board.id !== input.boardId)) {
      throw new ForbiddenException({ message: "Access denied." })
    }
    const board = await this.find({ boardId: input.boardId })
    const candidateToBeRemoved = await this.usersService.find({
      userId: input.memberId,
      relations: { boards: true },
    })
    if (candidateToBeRemoved.boards.every((board) => board.id !== input.boardId)) {
      throw new BadRequestException({ message: "The user is not a member of the board." })
    }
    board.members = board.members.filter((member) => member.id !== input.memberId)
    await this.boardsRepository.save(board)
    return await this.find({ boardId: input.boardId })
  }
}
