# -*- coding: utf-8 -*-
from __future__ import annotations

import typing as t

from msgspec import field
from msgspec import Struct


class PublishedSettingsDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    key: str
    type: t.Literal["numeric", "boolean", "string", "json"]
    display: bool
    description: t.Optional[str] = None
    default: t.Optional[t.Union[str, bool]] = None
    unit: t.Optional[str] = None
    label: t.Optional[str] = None  # if display is false, this isn't needed


class BackgroundJobDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    display_name: str
    job_name: str
    display: bool
    published_settings: list[PublishedSettingsDescriptor]
    source: t.Optional[str] = None  # what plugin / app created this job? Usually `app`
    description: t.Optional[str] = None  # if display is false, this isn't needed
    subtext: t.Optional[str] = None
    is_testing: bool = False


class AutomationPublishedSettingsDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    key: str
    default: t.Union[str, float, int, None]
    unit: t.Optional[str]
    label: str
    disabled: bool = False


class AutomationDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    display_name: str
    automation_name: str
    description: str
    source: t.Optional[str] = None  # what plugin / app created this automation? Usually `app`
    fields: list[AutomationPublishedSettingsDescriptor] = []


class ChartDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    chart_key: str
    data_source: str  # SQL table
    title: str
    source: str
    y_axis_label: str
    fixed_decimals: int
    down_sample: bool = True
    mqtt_topic: t.Optional[str] = None  # leave empty for no live updates from mqtt
    lookback: t.Union[int, str, float] = 100_000
    data_source_column: t.Optional[str] = None  # column in sql store
    payload_key: t.Optional[str] = None
    y_transformation: t.Optional[str] = "(y) => y"  # default is the identity
    y_axis_domain: t.Optional[list[float]] = None
    interpolation: t.Literal[
        "basis",
        "bundle",
        "cardinal",
        "catmullRom",
        "linear",
        "monotoneX",
        "monotoneY",
        "natural",
        "step",
        "stepAfter",
        "stepBefore",
    ] = "stepAfter"


# experiment profiles, a duplicate of what is in profile_structs.py in the core app
class Metadata(Struct):
    author: t.Optional[str] = None
    description: t.Optional[str] = None


class Plugin(Struct):
    name: str
    version: str  # can be a version, or version bound with version. Ex: "1.0.2", or ">=1.02", or "==1.0.2". See


######## Actions


class _LogOptions(Struct):
    message: str
    level: t.Literal[
        "DEBUG", "debug", "WARNING", "warning", "INFO", "info", "NOTICE", "notice", "ERROR", "error"
    ] = "notice"


class Log(Struct, tag=str.lower, forbid_unknown_fields=True):
    hours_elapsed: float
    options: _LogOptions


class Start(Struct, tag=str.lower, forbid_unknown_fields=True):
    hours_elapsed: float
    options: dict[str, t.Any] = {}
    args: list[str] = []


class Pause(Struct, tag=str.lower, forbid_unknown_fields=True):
    hours_elapsed: float


class Stop(Struct, tag=str.lower, forbid_unknown_fields=True):
    hours_elapsed: float


class Update(Struct, tag=str.lower, forbid_unknown_fields=True):
    hours_elapsed: float
    options: dict[str, t.Any] = {}


class Resume(Struct, tag=str.lower, forbid_unknown_fields=True):
    hours_elapsed: float


Action = t.Union[Log, Start, Pause, Stop, Update, Resume]

#######


PioreactorUnitName = str
PioreactorLabel = str
JobName = str
Jobs = dict[JobName, dict[t.Literal["actions"], list[Action]]]


class Profile(Struct, forbid_unknown_fields=True):
    experiment_profile_name: str
    metadata: Metadata = field(default_factory=Metadata)
    plugins: list[Plugin] = []
    stop_on_exit: bool = False
    labels: dict[PioreactorUnitName, PioreactorLabel] = {}
    common: Jobs = {}
    pioreactors: dict[
        t.Union[PioreactorLabel, PioreactorUnitName], dict[t.Literal["jobs"], Jobs]
    ] = {}
