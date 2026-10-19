import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType('StorefrontCategory')
export class CategoryType {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  slug?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  image?: string;
}
