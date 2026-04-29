import { Module } from "@nestjs/common";
import { DepartmentsModule } from "../departments/departments.module";
import { OrganizationMembersController } from "./organization-members.controller";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [DepartmentsModule],
  controllers: [OrganizationsController, OrganizationMembersController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
