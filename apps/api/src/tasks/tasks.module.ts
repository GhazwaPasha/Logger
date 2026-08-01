import { Module } from "@nestjs/common";
import { AttachmentsModule } from "../attachments/attachments.module";
import { DepartmentsModule } from "../departments/departments.module";
import { ListsModule } from "../lists/lists.module";
import { PushModule } from "../push/push.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TasksByIdController, TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [AttachmentsModule, DepartmentsModule, ListsModule, PushModule, RealtimeModule],
  controllers: [TasksController, TasksByIdController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
