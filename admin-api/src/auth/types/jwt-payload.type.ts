import { Role } from '../../common/enums/role.enum';
import { PermissionKey } from '../../common/auth/permissions';

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  grantedRoles?: Role[];
  grantedPermissions?: PermissionKey[];
  tokenType: 'access' | 'refresh';
  tokenId?: string;
};
