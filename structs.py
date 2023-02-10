# -*- coding: utf-8 -*-
from __future__ import annotations

import typing as t

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
    source: str
    published_settings: list[PublishedSettingsDescriptor]
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
    fields: list[AutomationPublishedSettingsDescriptor]


class ChartDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    chart_key: str
    data_source: str  # SQL table
    title: str
    mqtt_topic: str
    source: str
    y_axis_label: str
    fixed_decimals: int
    lookback: t.Union[int, str] = 100_000
    data_source_column: t.Optional[str] = None  # column in sql store
    payload_key: t.Optional[str] = None
    delta_hours: t.Optional[int] = None
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
