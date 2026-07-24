import { Module } from "@nestjs/common";
import { OAuthResourceVerifierService } from "./oauth-resource-verifier.service";

@Module({
  providers: [OAuthResourceVerifierService],
  exports: [OAuthResourceVerifierService],
})
export class OAuthResourceVerifierModule {}
