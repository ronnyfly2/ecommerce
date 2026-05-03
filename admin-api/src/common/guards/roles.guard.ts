import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  hasEffectivePermission,
  PermissionKey,
  resolvePermissionFromRequest,
} from '../auth/permissions';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const normalizedRequiredRoles = requiredRoles ?? [];

    const request = context.switchToHttp().getRequest();
    const user = request.user as {
      role?: Role;
      grantedRoles?: Role[];
      grantedPermissions?: PermissionKey[];
    };

    if (!user?.role) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const delegatedRoles = Array.isArray(user.grantedRoles)
      ? user.grantedRoles
      : [];

    const hasRoleAccess =
      normalizedRequiredRoles.length === 0 ||
      normalizedRequiredRoles.includes(user.role) ||
      delegatedRoles.some((role) => normalizedRequiredRoles.includes(role));

    if (user.role === Role.CUSTOMER) {
      if (hasRoleAccess) {
        return true;
      }

      throw new ForbiddenException('Insufficient permissions');
    }

    const requiredPermission = resolvePermissionFromRequest(
      request.method,
      request.originalUrl,
    );

    if (!requiredPermission) {
      if (hasRoleAccess) {
        return true;
      }

      throw new ForbiddenException('Insufficient permissions');
    }

    if (hasEffectivePermission(user.grantedPermissions, requiredPermission)) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
