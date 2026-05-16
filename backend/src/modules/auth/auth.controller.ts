import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, Length, IsEmail, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class SendOtpDto {
  @IsString() @IsNotEmpty() @Length(10, 15) phone: string;
}
class VerifyOtpDto {
  @IsString() @Length(10, 15) phone: string;
  @IsString() @Length(6, 6) code: string;
  @IsString() @IsNotEmpty() deviceId: string;
  @IsOptional() @IsString() name?: string;
}
class AdminLoginDto {
  @IsEmail() @IsNotEmpty() email: string;
  @IsString() @IsNotEmpty() @MinLength(6) password: string;
}
class GymRegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() gymName: string;
  @IsString() @IsNotEmpty() city: string;
  @IsString() @IsNotEmpty() area: string;
  @IsString() @IsNotEmpty() address: string;
  @IsString() @Length(10, 15) phone: string;
  @IsArray() @ArrayMinSize(1) categories: string[];
}
class CorporateRegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsString() @IsNotEmpty() companyName: string;
  @IsString() @IsNotEmpty() billingContact: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send OTP to a phone number' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto.phone);
  }

  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify OTP and issue JWT' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code, dto.deviceId, dto.name);
  }

  @Post('admin/setup')
  @HttpCode(200)
  @ApiOperation({ summary: 'One-time setup: create first super_admin if none exists' })
  setupAdmin(@Body() dto: AdminLoginDto) {
    return this.auth.setupFirstAdmin(dto.email, dto.password);
  }

  @Post('admin/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin / Gym / Corporate login (email + password)' })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.passwordLogin(dto.email, dto.password);
  }

  @Post('gym/register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new gym partner account' })
  registerGym(@Body() dto: GymRegisterDto) {
    return this.auth.registerGym(dto);
  }

  @Post('corporate/register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new corporate account' })
  registerCorporate(@Body() dto: CorporateRegisterDto) {
    return this.auth.registerCorporate(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: { refreshToken: string }) {
    return this.auth.refresh(dto.refreshToken);
  }
}
