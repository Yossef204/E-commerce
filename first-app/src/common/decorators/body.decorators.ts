//typescript know
//nest not know mst decorator to know that is body
// const fn(x:object){
//
// }

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Body = createParamDecorator(
  (data: string, context: ExecutionContext) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
    return request.body;
  },
);

// export class User {
//   fn(@Body() x: { userName: string; password: string }) {
//     x.userName
//   }
// }
