"""Add local_path column to projects table


Revision ID: add_local_path


Revises: 87a944231bcc


Create Date: 2026-05-18 05:02:00.000000


"""


from alembic import op


import sqlalchemy as sa


# revision identifiers, used by Alembic.


revision='add_local_path',


    down_revision= '87a944231bcc'


branch_labels = None


depends_on = None


def upgrade():


    """Add local_path column to projects table"""


    op.add_column('projects', sa.Column('local_path', sa.String(1000), nullable = True))


def downgrade():


    """Remove local_path column from projects table"""


    op.drop_column('projects', 'local_path')


