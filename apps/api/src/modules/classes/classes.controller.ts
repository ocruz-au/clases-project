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

@ApiTags('Catalog')
@Controller()
export class ClassesController {
  constructor(
    private readonly classesService: ClassesService,
    private readonly categoryService: CategoryService,
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

  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a category (admin)' })
  createCategory(
    @Body(new ZodValidationPipe(z.object({ name: z.string().min(1), slug: z.string().min(1), description: z.string().optional() })))
    body: { name: string; slug: string; description?: string },
  ) {
    return this.categoryService.create(body);
  }
}
