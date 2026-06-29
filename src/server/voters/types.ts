import type { AuthenticationMethodValue } from "../../domain/auth-policy/authentication-policy";
import type { VoterSession } from "../auth/voter-session";

export type {
  AuthStatusValue,
  AuthenticationPolicyRecord,
  CredentialEventInput,
  CredentialStatusValue,
  CredentialUpdateCommand,
  InvitationAuthRecord,
  InvitationStatusValue,
  VoterAuthRepository,
  VoterSessionAuthenticationCommand,
  VoterSessionCreateCommand,
  VoterSessionRecord,
  VotingCredentialAuthRecord
} from "./repository";

export type VerifyInvitationTokenResult = Readonly<{
  voterSession: VoterSession;
  opaqueHandle: string;
  authenticationMethod: AuthenticationMethodValue;
  requiresIdentifier: boolean;
  requiresOneTimeCode: boolean;
}>;

export type VerifyIdentifierResult = Readonly<{
  credentialUpdate: import("./repository").CredentialUpdateCommand;
  event: import("./repository").CredentialEventInput;
  authenticated: boolean;
}>;
