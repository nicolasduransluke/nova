import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { UserEntity } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { CreateUserDto } from '../dtos/create-user.dto';
import { generateId } from '@nova/utils';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: CreateUserDto): Promise<UserEntity> {
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = UserEntity.create({
      id: generateId(),
      email: dto.email,
      name: dto.name,
      metadata: dto.metadata,
    });

    return this.userRepository.save(user);
  }
}
