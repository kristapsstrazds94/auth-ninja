// Semgrep rule tests for styled-ui-in-react-package

function styledUiInReactPackage() {
  // ruleid: styled-ui-in-react-package
  return <input type="password" />;

  // ruleid: styled-ui-in-react-package
  return <button>Login</button>;

  // ok: styled-ui-in-react-package
  return <>{children}</>;
}
