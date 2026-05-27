"""Create roadmap tables

Revision ID: 001_create_roadmap_tables
Revises: 
Create Date: 2024-05-20 14:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_create_roadmap_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create roadmap_milestones table
    op.create_table('roadmap_milestones',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('priority', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('team', sa.String(length=100), nullable=False),
        sa.Column('progress', sa.Integer(), nullable=True, default=0),
        sa.Column('dependencies', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create roadmap_settings table
    op.create_table('roadmap_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('view', sa.String(length=20), nullable=True, default='months'),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('show_milestones', sa.Boolean(), nullable=True, default=True),
        sa.Column('show_dependencies', sa.Boolean(), nullable=True, default=False),
        sa.Column('show_progress', sa.Boolean(), nullable=True, default=True),
        sa.Column('show_teams', sa.Boolean(), nullable=True, default=True),
        sa.Column('theme', sa.String(length=20), nullable=True, default='default'),
        sa.Column('auto_save', sa.Boolean(), nullable=True, default=True),
        sa.Column('notifications', sa.Boolean(), nullable=True, default=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better performance
    op.create_index('idx_roadmap_milestones_status', 'roadmap_milestones', ['status'])
    op.create_index('idx_roadmap_milestones_priority', 'roadmap_milestones', ['priority'])
    op.create_index('idx_roadmap_milestones_team', 'roadmap_milestones', ['team'])
    op.create_index('idx_roadmap_milestones_date', 'roadmap_milestones', ['date'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_roadmap_milestones_date', table_name='roadmap_milestones')
    op.drop_index('idx_roadmap_milestones_team', table_name='roadmap_milestones')
    op.drop_index('idx_roadmap_milestones_priority', table_name='roadmap_milestones')
    op.drop_index('idx_roadmap_milestones_status', table_name='roadmap_milestones')
    
    # Drop tables
    op.drop_table('roadmap_settings')
    op.drop_table('roadmap_milestones')
