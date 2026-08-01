import { Module } from "@nestjs/common";
import { AttachmentsModule } from "../attachments/attachments.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsService } from "./departments.service";

@Module({
  imports: [AttachmentsModule, RealtimeModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
