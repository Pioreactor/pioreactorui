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
    default: t.Union[str, float, int]
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
    media_used: t.Optional[str] = None
    organism_used: t.Optional[str] = None


class Plugin(Struct):
    name: str
    version: str


class Action(Struct):
    type: t.Literal["start", "pause", "resume", "stop", "update", "log"]
    hours_elapsed: float
    options: dict[str, t.Any] = {}
    args: list[str] = []


PioreactorUnitName = str
PioreactorLabel = str
JobName = str
Jobs = dict[JobName, dict[t.Literal["actions"], list[Action]]]


class Profile(Struct):
    # should be the same as in pioreactor/experiment_profiles/profile_struct.py
    experiment_profile_name: str
    metadata: Metadata = field(default_factory=Metadata)
    plugins: list[Plugin] = []
    stop_on_exit: bool = False
    labels: dict[PioreactorUnitName, PioreactorLabel] = {}
    common: Jobs = {}
    pioreactors: dict[
        t.Union[PioreactorLabel, PioreactorUnitName], dict[t.Literal["jobs"], Jobs]
    ] = {}
