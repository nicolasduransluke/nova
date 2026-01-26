import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case';
import { CreateUserDto } from '../../application/dtos/create-user.dto';
import type { ApiResponse, User } from '@nova/types';

@Controller('users')
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<ApiResponse<User>> {
    const user = await this.createUserUseCase.execute(dto);
    return {
      success: true,
      data: user.toJSON() as User,
      message: 'User created successfully',
    };
  }

  @Get()
  async findAll(): Promise<ApiResponse<User[]>> {
    const users = await this.getUserUseCase.executeAll();
    return {
      success: true,
      data: users.map((user) => user.toJSON() as User),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse<User>> {
    const user = await this.getUserUseCase.execute(id);
    return {
      success: true,
      data: user.toJSON() as User,
    };
  }
}
