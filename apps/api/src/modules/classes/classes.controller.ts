import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CategoryService } from './category.service';
import { ClassesService } from './classes.service';
import { LocationService } from './location.service';
import { RoomService } from './room.service';

const createClassSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).optional(),
  defaultCapacity: z.number().int().positive(),
  cancellationPolicyId: z.string().uuid().optional(),
});

const updateClassSchema = createClassSchema.partial().omit({ categoryId: true, currency: true });

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
});

const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  timezone: z.string().optional(),
});

const roomSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  locationId: z.string().uuid(),
});

@ApiTags('Catalog')
@Controller()
export class ClassesController {
  constructor(
    private readonly classesService: ClassesService,
    private readonly categoryService: CategoryService,
    private readonly locationService: LocationService,
    private readonly roomService: RoomService,
  ) {}

  @Get('classes')
  @ApiOperation({ summary: 'List classes' })
  list(@Query('page') page?: string) {
    return this.classesService.list(page ? parseInt(page) : 1);
  }

  @Get('classes/:id')
  @ApiOperation({ summary: 'Get a class by id' })
  findOne(@Param('id') id: string) {
    return this.classesService.findById(id);
  }

  @Post('admin/classes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a class (admin)' })
  create(@Body(new ZodValidationPipe(createClassSchema)) body: z.infer<typeof createClassSchema>) {
    return this.classesService.create(body);
  }

  @Patch('admin/classes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a class (admin)' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClassSchema)) body: z.infer<typeof updateClassSchema>,
  ) {
    return this.classesService.update(id, body);
  }

  @Delete('admin/classes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft-delete a class (admin)' })
  remove(@Param('id') id: string) {
    return this.classesService.softDelete(id);
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'List categories' })
  listCategories() {
    return this.categoryService.list();
  }

  @Get('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  listAdminCategories() {
    return this.categoryService.list();
  }

  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a category (admin)' })
  createCategory(
    @Body(new ZodValidationPipe(categorySchema)) body: z.infer<typeof categorySchema>,
  ) {
    return this.categoryService.create(body);
  }

  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateCategory(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(categorySchema.partial())) body: Partial<z.infer<typeof categorySchema>>,
  ) {
    return this.categoryService.update(id, body);
  }

  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteCategory(@Param('id') id: string) {
    return this.categoryService.softDelete(id);
  }

  // ── Locations ──────────────────────────────────────────────────────────────

  @Get('locations')
  listLocations() {
    return this.locationService.list();
  }

  @Get('admin/locations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  listAdminLocations() {
    return this.locationService.list();
  }

  @Post('admin/locations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  createLocation(@Body(new ZodValidationPipe(locationSchema)) body: z.infer<typeof locationSchema>) {
    return this.locationService.create(body);
  }

  @Patch('admin/locations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateLocation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(locationSchema.partial())) body: Partial<z.infer<typeof locationSchema>>,
  ) {
    return this.locationService.update(id, body);
  }

  @Delete('admin/locations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteLocation(@Param('id') id: string) {
    return this.locationService.softDelete(id);
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  @Get('rooms')
  listRooms(@Query('locationId') locationId?: string) {
    return this.roomService.list(locationId);
  }

  @Get('admin/rooms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  listAdminRooms(@Query('locationId') locationId?: string) {
    return this.roomService.list(locationId);
  }

  @Post('admin/rooms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  createRoom(@Body(new ZodValidationPipe(roomSchema)) body: z.infer<typeof roomSchema>) {
    return this.roomService.create(body);
  }

  @Patch('admin/rooms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateRoom(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(roomSchema.partial().omit({ locationId: true }))) body: Partial<Omit<z.infer<typeof roomSchema>, 'locationId'>>,
  ) {
    return this.roomService.update(id, body);
  }

  @Delete('admin/rooms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteRoom(@Param('id') id: string) {
    return this.roomService.softDelete(id);
  }
}
