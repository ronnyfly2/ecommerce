import { Role } from '../../common/enums/role.enum';
import { PermissionKey } from '../../common/auth/permissions';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: Role;
      grantedRoles: Role[];
      grantedPermissions: PermissionKey[];
      isActive: boolean;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

export {};
