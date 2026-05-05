import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { DepartmentsService } from "./departments.service";

@Controller("organizations/:organizationId/departments")
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
  ) {
    return this.departments.list(user.id, organizationId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    return this.departments.create(user.id, organizationId, body);
  }

  @Patch(":departmentId")
  patch(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("departmentId") departmentId: string,
    @Body() body: unknown,
  ) {
    return this.departments.patch(user.id, organizationId, departmentId, body);
  }

  @Delete(":departmentId")
  remove(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("departmentId") departmentId: string,
  ) {
    return this.departments.remove(user.id, organizationId, departmentId);
  }
}
