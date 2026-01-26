import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    return UserEntity.create({
      id: user.id,
      email: user.email,
      name: user.name,
      metadata: user.metadata as Record<string, unknown>,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) return null;

    return UserEntity.create({
      id: user.id,
      email: user.email,
      name: user.name,
      metadata: user.metadata as Record<string, unknown>,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async findAll(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) =>
      UserEntity.create({
        id: user.id,
        email: user.email,
        name: user.name,
        metadata: user.metadata as Record<string, unknown>,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }),
    );
  }

  async save(user: UserEntity): Promise<UserEntity> {
    const created = await this.prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        metadata: user.metadata,
      },
    });

    return UserEntity.create({
      id: created.id,
      email: created.email,
      name: created.name,
      metadata: created.metadata as Record<string, unknown>,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  }

  async update(user: UserEntity): Promise<UserEntity> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name,
        metadata: user.metadata,
      },
    });

    return UserEntity.create({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      metadata: updated.metadata as Record<string, unknown>,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }
}
