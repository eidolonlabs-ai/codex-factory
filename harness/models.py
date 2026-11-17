"""Versioned, fail-closed inputs. No third-party runtime dependencies."""
import json
import re
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath


@dataclass(frozen=True)
class Task:
    schema_version: int
    id: str
    title: str
    specification: str
    acceptance_criteria: list[str]
    allowed_paths: list[str]
    base_ref: str


@dataclass(frozen=True)
class Check:
    name: str
    argv: list[str]
    timeout_seconds: int = 600


@dataclass(frozen=True)
class Limits:
    attempts: int = 3
    agent_seconds: int = 1200
    run_seconds: int = 5400


@dataclass(frozen=True)
class Config:
    schema_version: int
    checks: list[Check]
    limits: Limits = field(default_factory=Limits)
    model: str | None = None


def object_fields(value, required, optional=()):
    if not isinstance(value, dict) or not set(required) <= value.keys() or value.keys() - set(required) - set(optional):
        raise ValueError(f'Expected fields {required}; optional {optional}')


def nonempty(value):
    if not isinstance(value, str) or not value.strip() or '\x00' in value:
        raise ValueError('Expected nonempty string without NUL')
    return value


def positive(value):
    if type(value) is not int or value <= 0:
        raise ValueError('Limits must be positive integers')
    return value


def version(value):
    if type(value) is not int or value != 1:
        raise ValueError('Unsupported schema_version')


def load_task(path: Path) -> Task:
    data = json.loads(path.read_text())
    object_fields(data, Task.__dataclass_fields__)
    version(data['schema_version'])
    for name in ('id', 'title', 'specification', 'base_ref'):
        nonempty(data[name])
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,47}', data['id']) or data['base_ref'].startswith('-'):
        raise ValueError('Unsafe task ID or base ref')
    for name in ('acceptance_criteria', 'allowed_paths'):
        if not isinstance(data[name], list) or not data[name]:
            raise ValueError(f'{name} must be a nonempty list')
        for item in data[name]:
            nonempty(item)
    for item in data['allowed_paths']:
        p = PurePosixPath(item)
        if p.is_absolute() or any(x in ('', '.', '..') for x in item.split('/')) or '\\' in item or '.git' in p.parts:
            raise ValueError('Scopes must be normalized repository-relative paths')
    return Task(**data)


def load_config(path: Path) -> Config:
    data = json.loads(path.read_text())
    object_fields(data, ('schema_version', 'checks'), ('limits', 'model'))
    version(data['schema_version'])
    if not isinstance(data['checks'], list):
        raise ValueError('checks must be a list')
    checks = []
    for c in data['checks']:
        object_fields(c, ('name', 'argv'), ('timeout_seconds',))
        nonempty(c['name'])
        if not isinstance(c['argv'], list) or not c['argv']:
            raise ValueError('argv must be nonempty')
        for arg in c['argv']:
            nonempty(arg)
        positive(c.get('timeout_seconds', 600))
        checks.append(Check(**c))
    if len({c.name for c in checks}) != len(checks):
        raise ValueError('Duplicate check names')
    limits = data.get('limits', {})
    object_fields(limits, (), Limits.__dataclass_fields__)
    for v in limits.values():
        positive(v)
    if data.get('model') is not None:
        nonempty(data['model'])
    return Config(1, checks, Limits(**limits), data.get('model'))
