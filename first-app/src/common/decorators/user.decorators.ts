import { Request } from 'express';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface UserPayload {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

type RequestWithUser = Request & {
  user: UserPayload;
};

export const User = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.user[data] : request.user;
  },
);
