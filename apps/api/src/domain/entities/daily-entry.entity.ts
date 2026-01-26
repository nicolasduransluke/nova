import { EntryType } from '@nova/types';
import { calculateNovaPoints } from '@nova/utils';

export interface DailyEntryProps {
  id: string;
  userId: string;
  date: Date;
  type: EntryType;
  data: Record<string, unknown>;
  novaPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

export class DailyEntryEntity {
  private readonly props: DailyEntryProps;

  private constructor(props: DailyEntryProps) {
    this.props = props;
  }

  static create(props: {
    id: string;
    userId: string;
    date: Date;
    type: EntryType;
    data: Record<string, unknown>;
    novaPoints?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }): DailyEntryEntity {
    const now = new Date();
    const points = props.novaPoints ?? calculateNovaPoints(props.type, props.data);

    return new DailyEntryEntity({
      id: props.id,
      userId: props.userId,
      date: props.date,
      type: props.type,
      data: props.data,
      novaPoints: points,
      createdAt: props.createdAt || now,
      updatedAt: props.updatedAt || now,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get date(): Date {
    return this.props.date;
  }

  get type(): EntryType {
    return this.props.type;
  }

  get data(): Record<string, unknown> {
    return { ...this.props.data };
  }

  get novaPoints(): number {
    return this.props.novaPoints;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateData(data: Record<string, unknown>): DailyEntryEntity {
    const newData = { ...this.props.data, ...data };
    const newPoints = calculateNovaPoints(this.props.type, newData);

    return new DailyEntryEntity({
      ...this.props,
      data: newData,
      novaPoints: newPoints,
      updatedAt: new Date(),
    });
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      date: this.date,
      type: this.type,
      data: this.data,
      novaPoints: this.novaPoints,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
