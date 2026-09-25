export type UserRole = 'CUSTOMER' | 'SELLER' | 'COMPANY_ADMIN' | 'SUPER_ADMIN' | 'user' | 'admin' | 'seller';

export interface User {
  id: string;
  userName: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  isEmailVerified?: boolean;
  status?: string;
  profilePic?: string;
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (payload: {
    token: string;
    refreshToken?: string;
    sessionId?: string;
    user: User;
  }) => void;
  updateUser: (user: Partial<User>) => void;
  clearAuth: () => void;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  };
}

export interface RegisterRequest {
  userName: string;
  email: string;
  password: string;
  phoneNumber: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user?: Partial<User>;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
}

