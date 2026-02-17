import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomQueryDto } from './dto/room-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 409, description: 'Room number already exists' })
  create(@Body() createRoomDto: CreateRoomDto) {
    return this.roomsService.create(createRoomDto);
  }

  @Get()
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get all rooms with filters and pagination' })
  @ApiResponse({ status: 200, description: 'List of rooms retrieved successfully' })
  findAll(@Query() query: RoomQueryDto) {
    return this.roomsService.findAll(query);
  }

  @Get('available/:hospitalId')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get available rooms for a hospital' })
  @ApiResponse({ status: 200, description: 'Available rooms retrieved successfully' })
  findAvailable(
    @Param('hospitalId') hospitalId: string,
    @Query('roomType') roomType?: string,
  ) {
    return this.roomsService.findAvailable(hospitalId, roomType);
  }

  @Get('occupancy/:hospitalId')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get room and bed occupancy statistics' })
  @ApiResponse({ status: 200, description: 'Occupancy stats retrieved successfully' })
  getOccupancyStats(@Param('hospitalId') hospitalId: string) {
    return this.roomsService.getOccupancyStats(hospitalId);
  }

  @Get(':id')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get a room by ID' })
  @ApiResponse({ status: 200, description: 'Room retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Update a room' })
  @ApiResponse({ status: 200, description: 'Room updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomsService.update(id, updateRoomDto);
  }

  @Delete(':id')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Delete a room' })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete room with active admissions',
  })
  remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }
}
