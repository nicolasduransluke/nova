import { UserEntity } from './user.entity';

describe('UserEntity', () => {
  const validUserProps = {
    id: 'test-id-123',
    email: 'test@example.com',
    name: 'John Doe',
    metadata: { timezone: 'UTC' },
  };

  describe('create', () => {
    it('should create a valid user entity', () => {
      const user = UserEntity.create(validUserProps);

      expect(user.id).toBe(validUserProps.id);
      expect(user.email).toBe(validUserProps.email.toLowerCase());
      expect(user.name).toBe(validUserProps.name);
      expect(user.metadata).toEqual(validUserProps.metadata);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should lowercase the email', () => {
      const user = UserEntity.create({
        ...validUserProps,
        email: 'TEST@EXAMPLE.COM',
      });

      expect(user.email).toBe('test@example.com');
    });

    it('should create user with empty metadata by default', () => {
      const user = UserEntity.create({
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(user.metadata).toEqual({});
    });

    it('should throw error for invalid email', () => {
      expect(() =>
        UserEntity.create({
          ...validUserProps,
          email: 'invalid-email',
        }),
      ).toThrow('Invalid email format');
    });

    it('should throw error for empty email', () => {
      expect(() =>
        UserEntity.create({
          ...validUserProps,
          email: '',
        }),
      ).toThrow('Email cannot be empty');
    });
  });

  describe('updateName', () => {
    it('should return a new user entity with updated name', () => {
      const user = UserEntity.create(validUserProps);
      const updatedUser = user.updateName('Jane Doe');

      expect(updatedUser.name).toBe('Jane Doe');
      expect(updatedUser.id).toBe(user.id);
      expect(updatedUser.email).toBe(user.email);
      expect(updatedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(
        user.updatedAt.getTime(),
      );
    });
  });

  describe('updateMetadata', () => {
    it('should merge new metadata with existing', () => {
      const user = UserEntity.create(validUserProps);
      const updatedUser = user.updateMetadata({ newKey: 'newValue' });

      expect(updatedUser.metadata).toEqual({
        timezone: 'UTC',
        newKey: 'newValue',
      });
    });
  });

  describe('toJSON', () => {
    it('should return a plain object representation', () => {
      const user = UserEntity.create(validUserProps);
      const json = user.toJSON();

      expect(json).toHaveProperty('id', validUserProps.id);
      expect(json).toHaveProperty('email', validUserProps.email);
      expect(json).toHaveProperty('name', validUserProps.name);
      expect(json).toHaveProperty('metadata', validUserProps.metadata);
      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('updatedAt');
    });
  });
});
