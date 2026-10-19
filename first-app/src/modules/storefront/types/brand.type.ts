import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType('StorefrontBrand')
export class BrandType {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  slug?: string;
}
