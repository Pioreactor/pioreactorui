# -*- coding: utf-8 -*-
from __future__ import annotations

from setuptools import find_packages
from setuptools import setup

exec(compile(open("pioreactorui/version.py").read(), "pioreactorui/version.py", "exec"))


REQUIREMENTS = [
    "flask==3.0.2",
    "flup6==1.1.1",
    "python-dotenv==1.0.1",
    "paho-mqtt==2.1.0",
    "huey==2.5.0",
    "diskcache==5.6.3",
    "msgspec==0.18.5",
    "werkzeug==3.0.3",
    "pioreactor>=24.9.26",
]


setup(
    name="pioreactorui",
    version=__version__,  # type: ignore # noqa: F821
    license="MIT",
    description="",
    url="https://github.com/pioreactor/pioreactorui",
    keywords=[
        "microbiology",
        "bioreactor",
        "turbidostat",
        "raspberry pi",
        "education",
        "research",
        "flask",
    ],
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="Pioreactor",
    author_email="hello@pioreactor.com",
    install_requires=REQUIREMENTS,
    include_package_data=True,
    packages=find_packages(exclude=["*.tests", "*.tests.*"]),
    python_requires=">=3.11",
)
