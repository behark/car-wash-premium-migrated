# Security Policy & Best Practices

## 🔒 Overview

This document outlines the security measures, policies, and best practices implemented in the KiiltoLoisto Car Wash Booking System.

## 🛡️ Security Features

### 1. Authentication & Authorization
- **NextAuth.js** for secure session management
- JWT tokens with secure signing
- Role-based access control (admin/customer)
- Session expiry and refresh mechanisms
- Secure password hashing with bcrypt

### 2. Input Validation & Sanitization
- **Zod schemas** for type-safe validation
- HTML entity escaping to prevent XSS
- SQL injection protection via Prisma ORM
- File upload restrictions and sanitization
- URL and path traversal prevention

### 3. API Security
- **Rate limiting** per IP and API key
- CORS policy enforcement
- API key authentication for external access
- Request size limitations (10MB max)
- Method-specific middleware guards

### 4. Data Protection
- **Encryption at rest** for database backups
- TLS/SSL for all data in transit
- Sensitive data redaction in logs
- PII masking in error reports
- Secure cookie settings with httpOnly and sameSite

### 5. Spam & Bot Protection
- **Google reCAPTCHA v3** integration
- Honeypot fields for form protection
- Submission rate limiting
- Time-based validation checks
- IP-based tracking and blocking

### 6. Monitoring & Alerting
- **Sentry** for error tracking and performance
- Security event logging
- Suspicious activity detection
- Real-time alerts for critical issues
- Performance degradation monitoring

## 🚨 Security Headers

All responses include the following security headers:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Content Security Policy (CSP)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https: blob:;
connect-src 'self' https://api.stripe.com https://api.sendgrid.com;
```

## 🔐 Environment Variables

### Required Security Variables

```bash
# Authentication
NEXTAUTH_SECRET=          # 32+ character random string
NEXTAUTH_URL=             # Production URL

# Database
DATABASE_URL=             # PostgreSQL connection with SSL
DATABASE_BACKUP_KEY=      # 32-byte hex encryption key

# API Keys (rotate regularly)
SENDGRID_API_KEY=         # Email service
STRIPE_SECRET_KEY=        # Payment processing
RECAPTCHA_SECRET_KEY=     # Bot protection
SENTRY_DSN=              # Error tracking

# Security
CORS_ALLOWED_ORIGINS=     # Comma-separated allowed origins
ENABLE_RATE_LIMITING=true # Enable/disable rate limiting
MAX_REQUEST_SIZE=10485760 # 10MB in bytes
```

### Generating Secure Keys

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate DATABASE_BACKUP_KEY
openssl rand -hex 32

# Generate API keys in respective service dashboards
```

## 🛠️ Security Procedures

### 1. Dependency Management
- Run `npm audit` weekly
- Use `npm audit fix` for automatic updates
- Review and test major version updates
- Monitor for CVEs via GitHub Dependabot

### 2. Access Control
- Implement least privilege principle
- Regular access reviews
- Multi-factor authentication for admin accounts
- Session timeout after 30 minutes of inactivity

### 3. Data Handling
- Minimize data collection
- Implement data retention policies
- Provide data export/deletion for GDPR
- Regular database backups with encryption

### 4. Incident Response

#### Detection
1. Monitor Sentry alerts
2. Review security logs daily
3. Check rate limit violations
4. Analyze failed authentication attempts

#### Response
1. Isolate affected systems
2. Preserve evidence in logs
3. Apply security patches
4. Notify affected users if required
5. Document incident and remediation

#### Recovery
1. Restore from clean backups if needed
2. Verify system integrity
3. Update security measures
4. Post-incident review

## 🔍 Security Testing

### Automated Testing
- Security headers validation in CI/CD
- Dependency vulnerability scanning with Snyk
- OWASP ZAP for web vulnerability scanning
- Lighthouse security audits

### Manual Testing Checklist
- [ ] Test input validation on all forms
- [ ] Verify authentication flows
- [ ] Check authorization for protected routes
- [ ] Test rate limiting thresholds
- [ ] Validate CORS policies
- [ ] Review error messages for information leakage
- [ ] Test backup and recovery procedures

## 📊 Security Metrics

Track these metrics monthly:

1. **Failed login attempts** - Baseline: <100/month
2. **Rate limit violations** - Baseline: <50/day
3. **reCAPTCHA low scores** - Baseline: <5% of submissions
4. **Security header compliance** - Target: 100%
5. **Dependency vulnerabilities** - Target: 0 high/critical
6. **Mean time to patch** - Target: <48 hours for critical

## 🚫 Known Limitations

1. **Static Export Mode**: Some security features require server-side runtime
2. **Client-side validation**: Always validated server-side as well
3. **Rate limiting**: Per-instance, not distributed
4. **Backup storage**: Local storage in development mode

## 📝 Compliance

### GDPR Compliance
- Privacy policy at `/privacy`
- Cookie consent implementation
- Data portability via admin API
- Right to deletion support
- Data processing agreements with third parties

### PCI DSS (via Stripe)
- No credit card data stored locally
- All payment processing via Stripe
- TLS for all payment communications
- Regular security updates

## 🔄 Security Updates

### Update Schedule
- **Critical**: Within 24 hours
- **High**: Within 1 week
- **Medium**: Within 1 month
- **Low**: Next scheduled maintenance

### Update Process
1. Review security advisory
2. Test in development environment
3. Create backup before deployment
4. Deploy during low-traffic window
5. Monitor for issues post-deployment

## 📞 Security Contacts

### Internal
- Security Team: security@kiiltoloisto.fi
- DevOps Lead: devops@kiiltoloisto.fi

### External Services
- Stripe Security: security@stripe.com
- SendGrid Support: support@sendgrid.com
- Netlify Support: support@netlify.com

### Vulnerability Reporting
Please report security vulnerabilities to security@kiiltoloisto.fi

**Do not** create public GitHub issues for security vulnerabilities.

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Netlify Security](https://docs.netlify.com/security/)

---

*Last Updated: January 2025*
*Version: 1.0.0*