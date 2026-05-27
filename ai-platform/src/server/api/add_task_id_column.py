from database import db_config


from sqlalchemy import text


with db_config.engine.connect() as conn:


    conn.execute(text('ALTER TABLE analysis_results ADD COLUMN task_id VARCHAR(255)'))


    conn.commit()


    print("task_id column added successfully")


