import { Email } from '../value-objects/email.value-object';

export interface UserProps {
  id: string;
  email: Email;
  name: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class UserEntity {
  private readonly props: UserProps;

  private constructor(props: UserProps) {
    this.props = props;
  }

  static create(props: {
    id: string;
    email: string;
    name: string;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
  }): UserEntity {
    const email = Email.create(props.email);
    const now = new Date();

    return new UserEntity({
      id: props.id,
      email,
      name: props.name,
      metadata: props.metadata || {},
      createdAt: props.createdAt || now,
      updatedAt: props.updatedAt || now,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email.value;
  }

  get name(): string {
    return this.props.name;
  }

  get metadata(): Record<string, unknown> {
    return { ...this.props.metadata };
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateName(name: string): UserEntity {
    return new UserEntity({
      ...this.props,
      name,
      updatedAt: new Date(),
    });
  }

  updateMetadata(metadata: Record<string, unknown>): UserEntity {
    return new UserEntity({
      ...this.props,
      metadata: { ...this.props.metadata, ...metadata },
      updatedAt: new Date(),
    });
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
