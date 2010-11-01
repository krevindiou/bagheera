<?php

namespace Bagheera;

class ClassLoader extends \Doctrine\Common\ClassLoader
{
    protected $namespace;

    /**
     * @see \Doctrine\Common\ClassLoader::__construct
     */
    public function __construct($ns = null, $includePath = null)
    {
        parent::__construct($ns, $includePath);
        $this->namespace = $ns;
    }

    /**
     * @see \Doctrine\Common\ClassLoader::loadClass
     */
    public function loadClass($className)
    {
        if ($this->namespace !== null && strpos($className, $this->namespace.$this->getNamespaceSeparator()) !== 0) {
            return false;
        }

        $fileName = str_replace($this->getNamespaceSeparator(), DIRECTORY_SEPARATOR, $className) . $this->getFileExtension();
        $fileName = $this->_getAbsolutePath($fileName);

        if (false !== $fileName) {
            require $fileName;
            return true;
        } else {
            return false;
        }
    }

    protected function _getAbsolutePath($path)
    {
        $includePaths = explode(PATH_SEPARATOR, get_include_path());

        foreach ($includePaths as $includePath) {
            if (false !== ($absolutePath = realpath($includePath . DIRECTORY_SEPARATOR . $path))) {
                return $absolutePath;

            // Case sensitive file system
            } elseif (false !== ($absolutePath = realpath($includePath . DIRECTORY_SEPARATOR . strtolower(dirname($path)) . DIRECTORY_SEPARATOR . basename($path)))) {
                return $absolutePath;
            }
        }

        return false;
    }
}
