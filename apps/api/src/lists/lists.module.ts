import { Module } from "@nestjs/common";
import { DepartmentsModule } from "../departments/departments.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ListsController } from "./lists.controller";
import { ListsService } from "./lists.service";

@Module({
  imports: [DepartmentsModule, RealtimeModule],
  controllers: [ListsController],
  providers: [ListsService],
  exports: [ListsService],
})
export class ListsModule {}

