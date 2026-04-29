import { Module } from "@nestjs/common";
import { DepartmentsModule } from "../departments/departments.module";
import { AssignerOnlyGuard } from "./assigner-only.guard";
import { TasksByIdController, TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [DepartmentsModule],
  controllers: [TasksController, TasksByIdController],
  providers: [TasksService, AssignerOnlyGuard],
})
export class TasksModule {}
