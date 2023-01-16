import { UseGuards } from "@nestjs/common"
import { Args, Int, Mutation, Query, Resolver } from "@nestjs/graphql"

import { UserEntity } from "#models/users/entities/user.entity"

import { AuthorizationGuard } from "#helpers/authorization.guard"
import { AuthorizedUser } from "#helpers/authorized-user.decorator"

import { CreatePeriodRecordInput } from "./dto/create-period-record.input"
import { SearchPeriodRecordsArgs } from "./dto/search-period-records.args"
import { PeriodRecordEntity } from "./entities/period-record.entity"
import { PeriodRecord } from "./models/period-record.model"
import { PeriodRecordsService } from "./service"

@Resolver(() => PeriodRecord)
@UseGuards(AuthorizationGuard)
export class PeriodRecordsResolver {
  constructor(private readonly periodRecordsService: PeriodRecordsService) {}

  @Query((returns) => PeriodRecord, { name: "periodRecord" })
  find(
    @Args("id", { type: () => Int })
    recordId: PeriodRecordEntity["id"],
    @AuthorizedUser()
    authorizedUser: UserEntity
  ): Promise<PeriodRecordEntity> {
    return this.periodRecordsService.find({ authorizedUser, recordId })
  }

  @Query((returns) => [PeriodRecord], { name: "periodRecords" })
  search(
    @Args()
    args: SearchPeriodRecordsArgs,
    @AuthorizedUser()
    authorizedUser: UserEntity
  ): Promise<PeriodRecordEntity[]> {
    return this.periodRecordsService.search({ args, authorizedUser })
  }

  @Mutation((returns) => PeriodRecord, { name: "createPeriodRecord" })
  create(
    @Args("input")
    input: CreatePeriodRecordInput,
    @AuthorizedUser()
    authorizedUser: UserEntity
  ): Promise<PeriodRecordEntity> {
    return this.periodRecordsService.create({ authorizedUser, input })
  }

  // @Mutation((returns) => ActivityRecord, { name: "updateActivityRecord" })
  // update(
  //   @Args("input", ValidationPipe)
  //   input: UpdateActivityRecordInput,
  //   @AuthorizedUser()
  //   authorizedUser: UserEntity
  // ): Promise<PeriodRecordEntity> {
  //   return this.activityRecordsService.update({ authorizedUser, input })
  // }

  @Mutation((returns) => PeriodRecord, { name: "deletePeriodRecord" })
  delete(
    @Args("id", { type: () => Int })
    recordId: number,
    @AuthorizedUser()
    authorizedUser: UserEntity
  ): Promise<PeriodRecordEntity> {
    return this.periodRecordsService.delete({ authorizedUser, recordId })
  }
}
