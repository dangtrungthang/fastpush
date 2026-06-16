module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.fastpush.FastPushPackage;',
        packageInstance: 'new FastPushPackage()',
      },
    },
  },
};
