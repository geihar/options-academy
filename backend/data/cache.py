import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Any
from sqlalchemy.orm import Session
from database import CacheEntry

logger = logging.getLogger(__name__)


class Cache:
    def get(self, key: str, db: Session) -> Optional[Any]:
        """Return cached data if it exists and has not expired."""
        try:
            entry = db.query(CacheEntry).filter(CacheEntry.key == key).first()
            if entry is None:
                return None
            if entry.expires_at < datetime.utcnow():
                db.delete(entry)
                db.commit()
                return None
            return json.loads(entry.data)
        except Exception as e:
            logger.warning(f"Cache get error for key={key}: {e}")
            return None

    def set(self, key: str, data: Any, db: Session, ttl_seconds: int = 900) -> None:
        """Store data in cache with TTL."""
        try:
            expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
            serialized = json.dumps(data)

            existing = db.query(CacheEntry).filter(CacheEntry.key == key).first()
            if existing:
                existing.data = serialized
                existing.expires_at = expires_at
            else:
                entry = CacheEntry(key=key, data=serialized, expires_at=expires_at)
                db.add(entry)
            db.commit()
        except Exception as e:
            logger.warning(f"Cache set error for key={key}: {e}")

    def delete(self, key: str, db: Session) -> None:
        """Remove a cache entry."""
        try:
            entry = db.query(CacheEntry).filter(CacheEntry.key == key).first()
            if entry:
                db.delete(entry)
                db.commit()
        except Exception as e:
            logger.warning(f"Cache delete error for key={key}: {e}")

    def purge_expired(self, db: Session) -> int:
        """Remove all expired cache entries. Returns count removed."""
        try:
            count = db.query(CacheEntry).filter(CacheEntry.expires_at < datetime.utcnow()).delete()
            db.commit()
            return count
        except Exception as e:
            logger.warning(f"Cache purge error: {e}")
            return 0


cache = Cache()
