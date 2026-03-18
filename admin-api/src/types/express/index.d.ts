import { Role } from '../../common/enums/role.enum';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: Role;
      isActive: boolean;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

export {};
