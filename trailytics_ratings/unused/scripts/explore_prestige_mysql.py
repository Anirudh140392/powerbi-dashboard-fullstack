import os
import mysql.connector
from dotenv import load_dotenv


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def main():
    load_dotenv()
    conn = mysql.connector.connect(
        host=require_env("PRESTIGE_MYSQL_HOST"),
        user=require_env("PRESTIGE_MYSQL_USER"),
        password=require_env("PRESTIGE_MYSQL_PASSWORD"),
        database=require_env("PRESTIGE_MYSQL_DATABASE"),
        port=3306,
    )
    cur = conn.cursor()
    cur.execute("SHOW TABLES")
    print("Tables:")
    for (table_name,) in cur.fetchall():
        print(f"  {table_name}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
