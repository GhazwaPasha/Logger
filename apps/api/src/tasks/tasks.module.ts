import { Module } from "@nestjs/common";
import { DepartmentsModule } from "../departments/departments.module";
import { ListsModule } from "../lists/lists.module";
import { PushModule } from "../push/push.module";
import { AssignerOnlyGuard } from "./assigner-only.guard";
import { TasksByIdController, TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [DepartmentsModule, ListsModule, PushModule],
  controllers: [TasksController, TasksByIdController],
  providers: [TasksService, AssignerOnlyGuard],
  exports: [TasksService],
})
export class TasksModule {}
