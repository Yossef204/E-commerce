import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { UserRepo } from '../../models/user/user.repository';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { FileUploadsService } from '../../shared/file-uploads/file-uploads.service';
import { RolesEnum } from '../../common/enums/roles';
import { AccountStatusEnum } from '../../common/enums/account-status';

describe('UserService', () => {
  let service: UserService;
  let userRepo: {
    getOne: jest.Mock;
    getAll: jest.Mock;
    updateOne: jest.Mock;
  };
  let mainOrderRepo: {
    getAll: jest.Mock;
  };
  let fileUploadsService: {
    deleteFile: jest.Mock;
    getPresignedUrl: jest.Mock;
  };

  const mockUserId = new Types.ObjectId('650000000000000000000055');

  const mockUserDoc = {
    _id: mockUserId,
    userName: 'John Doe',
    email: 'john@example.com',
    password: 'hashed_password_123',
    role: RolesEnum.CUSTOMER,
    status: AccountStatusEnum.ACTIVE,
    phoneNumber: '0123456789',
    address: '123 Main St',
    addresses: ['123 Main St', '456 Second St'],
    profilePic: 'avatars/old_pic.jpg',
    emailVerificationOtpHash: 'otp_hash',
    emailVerificationOtpExpiresAt: new Date(),
    toObject() {
      const { toObject, ...rest } = this;
      return rest;
    },
  };

  beforeEach(async () => {
    userRepo = {
      getOne: jest.fn(),
      getAll: jest.fn(),
      updateOne: jest.fn(),
    };

    mainOrderRepo = {
      getAll: jest.fn(),
    };

    fileUploadsService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getPresignedUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepo,
          useValue: userRepo,
        },
        {
          provide: MainOrderRepo,
          useValue: mainOrderRepo,
        },
        {
          provide: FileUploadsService,
          useValue: fileUploadsService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should throw BadRequestException if userId is not a valid Mongo ObjectId', async () => {
      await expect(service.getProfile('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user is not found in database', async () => {
      userRepo.getOne.mockResolvedValue(null);

      await expect(
        service.getProfile(mockUserId.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return safe user profile without password/otps along with orders', async () => {
      userRepo.getOne.mockResolvedValue(mockUserDoc);
      const mockOrders = [
        { _id: new Types.ObjectId(), totalAmount: 150 },
      ];
      mainOrderRepo.getAll.mockResolvedValue(mockOrders);

      const result = await service.getProfile(mockUserId.toString());

      expect(userRepo.getOne).toHaveBeenCalledWith({ _id: mockUserId });
      expect(mainOrderRepo.getAll).toHaveBeenCalledWith(
        { customerId: mockUserId },
        undefined,
        { sort: { createdAt: -1 } },
      );
      expect(result.success).toBe(true);
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('emailVerificationOtpHash');
      expect(result.user.userName).toBe('John Doe');
      expect(result.orders).toEqual(mockOrders);
    });
  });

  describe('updateProfile', () => {
    it('should throw BadRequestException if userId is invalid', async () => {
      await expect(
        service.updateProfile('invalid-id', { userName: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.getOne.mockResolvedValue(null);

      await expect(
        service.updateProfile(mockUserId.toString(), { userName: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user fields and return safe updated user', async () => {
      userRepo.getOne.mockResolvedValue(mockUserDoc);
      const updatedDoc = {
        ...mockUserDoc,
        userName: 'Jane Doe',
        phoneNumber: '0987654321',
        toObject() {
          const { toObject, ...rest } = this;
          return rest;
        },
      };
      userRepo.updateOne.mockResolvedValue(updatedDoc);

      const result = await service.updateProfile(mockUserId.toString(), {
        userName: 'Jane Doe',
        phoneNumber: '0987654321',
      });

      expect(userRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockUserId },
        {
          $set: {
            userName: 'Jane Doe',
            phoneNumber: '0987654321',
          },
        },
        { new: true },
      );
      expect(result.success).toBe(true);
      expect(result.user.userName).toBe('Jane Doe');
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('changePassword', () => {
    it('should throw BadRequestException if current password does not match', async () => {
      userRepo.getOne.mockResolvedValue(mockUserDoc);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false as never));

      await expect(
        service.changePassword(mockUserId.toString(), {
          currentPassword: 'wrong_password',
          newPassword: 'new_password_123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should hash new password and update user on valid current password', async () => {
      userRepo.getOne.mockResolvedValue(mockUserDoc);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));
      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('new_hashed_pass' as never));
      userRepo.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.changePassword(mockUserId.toString(), {
        currentPassword: 'hashed_password_123',
        newPassword: 'new_password_123',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'hashed_password_123',
        mockUserDoc.password,
      );
      expect(userRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockUserId },
        { password: 'new_hashed_pass' },
      );
      expect(result).toEqual({
        success: true,
        message: 'تم تغيير كلمة المرور بنجاح',
      });
    });
  });

  describe('updateProfilePic', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      userRepo.getOne.mockResolvedValue(null);

      await expect(
        service.updateProfilePic(mockUserId.toString(), 'avatars/new.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update avatar and delete old avatar file from storage', async () => {
      userRepo.getOne.mockResolvedValue(mockUserDoc);
      const updatedDoc = { ...mockUserDoc, profilePic: 'avatars/new.jpg' };
      userRepo.updateOne.mockResolvedValue(updatedDoc);

      const result = await service.updateProfilePic(
        mockUserId.toString(),
        'avatars/new.jpg',
      );

      expect(userRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockUserId },
        { $set: { profilePic: 'avatars/new.jpg' } },
        { new: true },
      );
      expect(fileUploadsService.deleteFile).toHaveBeenCalledWith(
        'avatars/old_pic.jpg',
      );
      expect(result).toEqual(updatedDoc);
    });
  });

  describe('getAllUsers', () => {
    it('should return all users with password and otp stripped', async () => {
      userRepo.getAll.mockResolvedValue([mockUserDoc]);

      const result = await service.getAllUsers();

      expect(userRepo.getAll).toHaveBeenCalledWith({}, undefined, {
        sort: { createdAt: -1 },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[0].userName).toBe('John Doe');
    });

    it('should apply role filter regex when role is provided and not ALL', async () => {
      userRepo.getAll.mockResolvedValue([mockUserDoc]);

      await service.getAllUsers(RolesEnum.CUSTOMER);

      expect(userRepo.getAll).toHaveBeenCalledWith(
        { role: { $regex: new RegExp(`^${RolesEnum.CUSTOMER}$`, 'i') } },
        undefined,
        { sort: { createdAt: -1 } },
      );
    });
  });
});
