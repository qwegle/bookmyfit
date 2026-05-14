import { Body, Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { QrService } from './qr.service';

class GenerateQrDto {
  @IsUUID() subscriptionId: string;
}
class ValidateQrDto {
  @IsString() qrToken: string;
  @IsUUID() gymId: string;
}

@ApiTags('QR Check-in')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('qr')
export class QrController {
  constructor(private readonly qr: QrService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a 30-second QR token (mobile app)' })
  generate(@Req() req: any, @Body() dto: GenerateQrDto) {
    return this.qr.generateQr(req.user.userId, dto.subscriptionId);
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('gym_owner', 'gym_staff', 'super_admin')
  @ApiOperation({ summary: 'Validate a QR token (gym panel scanner)' })
  validate(@Body() dto: ValidateQrDto) {
    return this.qr.validateQr(dto.qrToken, dto.gymId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get current user check-in history' })
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.qr.getUserHistory(req.user.userId, limit ? parseInt(limit, 10) : 50);
  }
}
