export * from './permission';

export type UserRole =
  | 'CUSTOMER'
  | 'SELLER'
  | 'COMPANY_ADMIN'
  | 'SUPER_ADMIN'
  | 'user'
  | 'admin'
  | 'seller'
  | 'company_admin'
  | 'customer'
  | 'super_admin'
  | 'ADMIN'
  | 'superadmin';

export interface User {
  id: string;
  userName: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  isEmailVerified?: boolean;
  status?: string;
  profilePic?: string;
  permissions?: string[];
  sellingEntityId?: string;
  entityStatus?: string | null;
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
  // دالة تحديث التوكنز السريعة الخاصة بالـ Refresh Token
  setTokens: (token: string, refreshToken?: string) => void;
  updateUser: (user: Partial<User>) => void;
  clearAuth: () => void;
  logout: () => void;
  getVerifiedRole: () => UserRole | null;
  getVerifiedPermissions: () => string[];
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
    user?: User;
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