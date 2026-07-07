Name:           simplebeacon-local-agent
Version:        1.0.2
Release:        1%{?dist}
Summary:        Local agent for SimpleBeacon code analysis
License:        MIT
URL:            https://simplebeacon.ai
Source0:        simplebeacon-local-agent-%{version}.tar.gz
BuildArch:      noarch
Requires:       nodejs >= 18.0.0

%description
Lets the SimpleBeacon web dashboard and VS Code extension scan
local filesystem paths without uploading source code.

%prep
%autosetup

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/usr/share/simplebeacon-local-agent
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/lib/systemd/user
cp -a * %{buildroot}/usr/share/simplebeacon-local-agent/
ln -s ../share/simplebeacon-local-agent/start-agent.sh %{buildroot}/usr/bin/simplebeacon-local-agent
cat > %{buildroot}/usr/lib/systemd/user/simplebeacon-local-agent.service <<EOF
[Unit]
Description=SimpleBeacon Local Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/share/simplebeacon-local-agent/start-agent.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

%post
%systemd_user_post simplebeacon-local-agent.service
systemctl --user daemon-reload || true
systemctl --user enable simplebeacon-local-agent.service || true
systemctl --user start simplebeacon-local-agent.service || true

%preun
%systemd_user_preun simplebeacon-local-agent.service

%files
/usr/share/simplebeacon-local-agent
/usr/bin/simplebeacon-local-agent
/usr/lib/systemd/user/simplebeacon-local-agent.service

%changelog
* Mon Jul 07 2026 SimpleBeacon <support@simplebeacon.ai> - 1.0.2-1
- Initial RPM package
