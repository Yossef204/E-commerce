import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SellingEntityService } from './selling-entity.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateIndependentSellerDto } from './dto/create-independent-seller.dto';
import { UpdateEntityStatusDto } from './dto/update-entity-status.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('selling-entities')
export class SellingEntityController {
  constructor(private readonly sellingEntityService: SellingEntityService) {}

  @Post('company')
  async registerCompany(
    @Body() createCompanyDto: CreateCompanyDto,
    @Body('ownerId') ownerId: string,
  ) {
    return this.sellingEntityService.registerCompany(ownerId, createCompanyDto);
  }

  @Post('independent-seller')
  async registerIndependentSeller(
    @Body() createIndependentSellerDto: CreateIndependentSellerDto,
    @Body('ownerId') ownerId: string,
  ) {
    return this.sellingEntityService.registerIndependentSeller(
      ownerId,
      createIndependentSellerDto,
    );
  }

  @UseGuards(AuthenticationGuard)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateEntityStatusDto,
  ) {
    return this.sellingEntityService.updateStatus(id, updateStatusDto);
  }

  @UseGuards(AuthenticationGuard)
  @Get('profile/:ownerId')
  async getProfile(@Param('ownerId') ownerId: string) {
    return this.sellingEntityService.getProfile(ownerId);
  }

  @UseGuards(AuthenticationGuard)
  @Get(':id/dashboard-metrics')
  async getDashboardMetrics(@Param('id') id: string) {
    return this.sellingEntityService.getDashboardMetrics(id);
  }

  @UseGuards(AuthenticationGuard)
  @Get()
  async findAll() {
    return this.sellingEntityService.findAll();
  }
}
