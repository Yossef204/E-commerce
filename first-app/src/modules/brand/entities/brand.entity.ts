import { Types } from 'mongoose';

export class Brand {
  name: string;
  slug: string;
  folderId: string;
  image: string;
  categoryId: Types.ObjectId[];
}
