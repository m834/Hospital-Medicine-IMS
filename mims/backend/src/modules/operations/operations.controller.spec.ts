import { Test, TestingModule } from '@nestjs/testing';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

describe('OperationsController', () => {
  let controller: OperationsController;

  const mockOperationsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    reschedule: jest.fn(),
    createTheatre: jest.fn(),
    findTheatres: jest.fn(),
    findTheatre: jest.fn(),
    updateTheatre: jest.fn(),
    getTheatreAvailability: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [
        {
          provide: OperationsService,
          useValue: mockOperationsService,
        },
      ],
    }).compile();

    controller = module.get<OperationsController>(OperationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
