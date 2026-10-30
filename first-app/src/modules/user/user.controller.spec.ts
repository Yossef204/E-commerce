import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfilePicDto } from './dto/update-profile-pic.dto';
import { RolesEnum } from '../../common/enums/roles';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';

describe('UserController', () => {
  let controller: UserController;
  let userService: {
    getAllUsers: jest.Mock;
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
    changePassword: jest.Mock;
    updateProfilePic: jest.Mock;
  };

  const mockUserId = new Types.ObjectId('650000000000000000000055').toString();

  beforeEach(async () => {
    userService = {
      getAllUsers: jest.fn(),
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      updateProfilePic: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: userService,
        },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      ],
    })
      .overrideGuard(AuthenticationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('should return all users wrapped in success object', async () => {
      const usersList = [{ id: mockUserId, userName: 'SuperAdmin' }];
      userService.getAllUsers.mockResolvedValue(usersList);

      const result = await controller.getAllUsers(RolesEnum.SUPER_ADMIN);

      expect(userService.getAllUsers).toHaveBeenCalledWith(RolesEnum.SUPER_ADMIN);
      expect(result).toEqual({
        success: true,
        data: usersList,
      });
    });
  });

  describe('getProfile', () => {
    it('should fetch user profile using user ID from @User decorator or req.user', async () => {
      const profile = { success: true, user: { id: mockUserId } };
      userService.getProfile.mockResolvedValue(profile);

      const req = { user: { id: mockUserId } };
      const result = await controller.getProfile(req, mockUserId);

      expect(userService.getProfile).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(profile);
    });

    it('should fallback to req.user.sub when userId is not directly provided', async () => {
      const profile = { success: true, user: { id: mockUserId } };
      userService.getProfile.mockResolvedValue(profile);

      const req = { user: { sub: mockUserId } };
      const result = await controller.getProfile(req, undefined);

      expect(userService.getProfile).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(profile);
    });
  });

  describe('updateProfile', () => {
    it('should call userService.updateProfile with user ID and DTO', async () => {
      const dto: UpdateProfileDto = { userName: 'Updated Name' };
      const updateResult = { success: true, user: { userName: 'Updated Name' } };
      userService.updateProfile.mockResolvedValue(updateResult);

      const req = { user: { id: mockUserId } };
      const result = await controller.updateProfile(req, dto, mockUserId);

      expect(userService.updateProfile).toHaveBeenCalledWith(mockUserId, dto, req.user);
      expect(result).toEqual(updateResult);
    });
  });

  describe('changePassword', () => {
    it('should call userService.changePassword with user ID and passwords', async () => {
      const dto: ChangePasswordDto = {
        currentPassword: 'old_password_123',
        newPassword: 'new_password_123',
      };
      const changeResult = { success: true, message: 'Password changed' };
      userService.changePassword.mockResolvedValue(changeResult);

      const req = { user: { id: mockUserId } };
      const result = await controller.changePassword(req, dto, mockUserId);

      expect(userService.changePassword).toHaveBeenCalledWith(mockUserId, dto);
      expect(result).toEqual(changeResult);
    });
  });

  describe('updateProfilePic', () => {
    it('should call userService.updateProfilePic with user ID and profilePic URL', async () => {
      const dto: UpdateProfilePicDto = {
        profilePic: 'https://cdn.example.com/new-avatar.png',
      };
      const avatarResult = { profilePic: dto.profilePic };
      userService.updateProfilePic.mockResolvedValue(avatarResult);

      const req = { user: { id: mockUserId } };
      const result = await controller.updateProfilePic(req, dto, mockUserId);

      expect(userService.updateProfilePic).toHaveBeenCalledWith(
        mockUserId,
        dto.profilePic,
      );
      expect(result).toEqual(avatarResult);
    });
  });
});
