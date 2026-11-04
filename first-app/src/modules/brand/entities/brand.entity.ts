import { Types } from 'mongoose';

export class Brand {
  name: string;
  slug: string;
  folderId?: string;
  image?: string;
  categoryId: Types.ObjectId[];
  sellingEntityId?: Types.ObjectId | null;
  isActive?: boolean;
  isDeleted?: boolean;
  deletedAt?: Date | null;
}
